import { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { loadAllH3Layers, showResolution, setH3Opacity, applyAmenityData } from './h3Layer'
import './App.css'

const INITIAL_CENTER = [-73.9712, 40.6942]
const INITIAL_ZOOM = 10
const MARKER_ZOOM_THRESHOLD = 13

const MAP_STYLES = {
  light: 'mapbox://styles/mapbox/light-v11',
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  transit: 'mapbox://styles/mapbox/standard',
}

function App() {
  const mapRef = useRef(null)
  const mapContainerRef = useRef(null)

  const [activeTab, setActiveTab] = useState('map')
  const [showH3, setShowH3] = useState(true)
  const [opacity, setOpacity] = useState(0.45)
  const [resolution, setResolution] = useState(7)
  const [pendingResolution, setPendingResolution] = useState(7)
  const [layersReady, setLayersReady] = useState(false)
  const [selectedAmenity, setSelectedAmenity] = useState('')
  const [amenityTypes, setAmenityTypes] = useState([])
  const [amenityCache, setAmenityCache] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [darkMode, setDarkMode] = useState(true)
  const [satellite, setSatellite] = useState(false)
  const [usingCache, setUsingCache] = useState(false)
  const markersRef = useRef([])

  const handleResetView = () => {
    if (!mapRef.current) return
    mapRef.current.flyTo({ center: INITIAL_CENTER, zoom: INITIAL_ZOOM })
  }

  const updateMarkerVisibility = () => {
    if (!mapRef.current) return
    const zoom = mapRef.current.getZoom()
    const visible = zoom >= MARKER_ZOOM_THRESHOLD
    markersRef.current.forEach(m => {
      m.getElement().style.display = visible ? 'block' : 'none'
    })
  }


  const fetchAndApply = (type) => {

    if (!mapRef.current || !type) return
    const visible = mapRef.current.getZoom() >= MARKER_ZOOM_THRESHOLD

    const amenities = amenityCache[type]
    if (!amenities) return

    console.log(`${type} fetched: ${amenities.length}`)
    applyAmenityData(mapRef.current, amenities, type)

    
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    amenities.forEach((place) => {
      if (!place.lat || !place.lng) return
    
      const marker = new mapboxgl.Marker({ color: "#B91C1C", scale: 0.5 })
        .setLngLat([place.lng, place.lat])
        .setPopup(
          new mapboxgl.Popup().setHTML(
            `<b>${place.name || type}</b><br/>${place.lat}, ${place.lng}`
          )
        )
        .addTo(mapRef.current)

      marker.getElement().style.display = visible ? 'block' : 'none'

      markersRef.current.push(marker)
    })
  }

  const applyMapStyle = (style) => {
    if (!mapRef.current) return
    setLayersReady(false)
    mapRef.current.setStyle(style)
    mapRef.current.once('style.load', async () => {
      await loadAllH3Layers(mapRef.current)
      setLayersReady(true)
      if (selectedAmenity) fetchAndApply(selectedAmenity)
    })
  }

  const handleDarkToggle = () => {
    const newDark = !darkMode
    setDarkMode(newDark)
    if (!satellite) {
      applyMapStyle(newDark ? MAP_STYLES.dark : MAP_STYLES.light)
    }
  }

  const handleSatelliteToggle = () => {
    const newSat = !satellite
    setSatellite(newSat)
    if (newSat) {
      applyMapStyle(MAP_STYLES.satellite)
    } else {
      applyMapStyle(darkMode ? MAP_STYLES.dark : MAP_STYLES.light)
    }
  }

  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES.dark,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
    })

    mapRef.current.on('zoom', updateMarkerVisibility)

    mapRef.current.on('load', async () => {
      await loadAllH3Layers(mapRef.current)
      setLayersReady(true)
    })

    const fetchAmenityTypes = async () => {
      let types = []
      let fromCache = false
      try {
        const res = await fetch('http://localhost:3001/api/amenity-types')
        if (!res.ok) throw new Error('Backend error')
        types = await res.json()
        setAmenityTypes(types)
      } catch (err) {
        fromCache = true
        console.warn('Backend unavailable, using cached types:', err.message)
        try {
          const fallback = await fetch('/cache/amenity-types.json')
          types = await fallback.json()
          setAmenityTypes(types)
        } catch {
          console.error('No cached amenity types available')
          return
        }
      }

      // Preload all amenity data
      const cache = {}
      for (const type of types) {
        try {
          const res = await fetch(`http://localhost:3001/api/amenities?type=${type}`)
          if (!res.ok) throw new Error('Backend error')
          cache[type] = await res.json()
        } catch {
          fromCache = true
          try {
            const fallback = await fetch(`/cache/${type}.json`)
            cache[type] = await fallback.json()
          } catch {
            console.error(`No data for ${type}`)
          }
        }
      }
      setAmenityCache(cache)
      setUsingCache(fromCache)
    }

    fetchAmenityTypes()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!layersReady) return
    fetchAndApply(selectedAmenity)
  }, [selectedAmenity, layersReady, amenityCache])

  useEffect(() => {
    if (!mapRef.current || !layersReady) return
    showResolution(mapRef.current, showH3 ? resolution : null)
  }, [resolution, showH3, layersReady])

  useEffect(() => {
    if (!mapRef.current || !layersReady) return
    setH3Opacity(mapRef.current, opacity)
  }, [opacity, layersReady])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" spellCheck={false}>AmenityGap NYC</div>
        <nav className="topnav">
          {['about', 'map', 'data'].map((tab) => (
            <span
              key={tab}
              className={activeTab === tab ? 'active-tab' : ''}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </span>
          ))}
        </nav>
      </header>

      <div className="content-area">
        <aside className="sidebar-panel">

          <div className="panel-card">
            <select
              className="amenity-select"
              value={selectedAmenity}
              onChange={(e) => setSelectedAmenity(e.target.value)}
            >
              <option value="">Select Amenity</option>
              {amenityTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="panel-card">
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="search-icon">🔍</span>
            </div>
          </div>

          <div className="panel-card">
            <h3 className="panel-title italic">Filters</h3>

            <div className="control-group">
              <label className="control-label">Show H3 Grid</label>
              <input
                type="checkbox"
                checked={showH3}
                onChange={(e) => setShowH3(e.target.checked)}
              />
            </div>

            <div className="control-group">
              <label className="control-label">Resolution: {pendingResolution}</label>
              <input
                type="range" min="7" max="9" step="1"
                value={pendingResolution}
                onChange={(e) => setPendingResolution(Number(e.target.value))}
                onMouseUp={() => setResolution(pendingResolution)}
                onTouchEnd={() => setResolution(pendingResolution)}
              />
            </div>

            <div className="control-group">
              <label className="control-label">Opacity: {opacity.toFixed(2)}</label>
              <input
                type="range" min="0" max="1" step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
              />
            </div>

            <button className="reset-btn" onClick={handleResetView}>
              Reset View
            </button>
          </div>

          <div className="panel-card">
            <h3 className="panel-title italic">View Settings</h3>
            <div className="toggle-row">
              <span>Dark Mode</span>
              <div
                className={`toggle-switch ${darkMode ? 'on' : ''}`}
                onClick={handleDarkToggle}
              />
            </div>
            <div className="toggle-row">
              <span>Satellite</span>
              <div
                className={`toggle-switch ${satellite ? 'on' : ''}`}
                onClick={handleSatelliteToggle}
              />
            </div>
          </div>

        </aside>

        <main className="map-area">
          <div id="map-container" ref={mapContainerRef} />
          {usingCache && (
            <div className="cache-warning">
              ⚠ Using cached data! — Live database is currently unavailable.
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App