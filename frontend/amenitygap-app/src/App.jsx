import { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { loadAllH3Layers, showResolution, setH3Opacity, applyAmenityData, applyPopulationData, applyJobsData, applyOpportunityScores } from './h3Layer'
import { calculateOpportunityScores } from './scoring'
import { useDebouncedValue } from './useDebouncedValue'
import './App.css'
import LandingPage from './landingPage'
import AboutPage from './AboutPage'
import DataPage from './DataPage'



const INITIAL_CENTER = [-73.9712, 40.6942]
const INITIAL_ZOOM = 10

const MAP_STYLES = {
  light: 'mapbox://styles/mapbox/light-v11',
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  transit: 'mapbox://styles/mapbox/standard',
}

const DEFAULT_WEIGHTS = {
  laundry: 2000,
  deli: 1500,
  pharmacy: 3000,
  barber: 2500,
  gas_station: 5000,
}

const DEFAULT_BOROUGH_MULTIPLIERS = {
  Manhattan: 1.0,
  Brooklyn: 1.0,
  Queens: 1.0,
  Bronx: 1.0,
  'Staten Island': 1.0,
}

const SPILLOVER_DEFAULTS_BY_RES = {
  7: { ring1: 0.10, ring2: 0.00 },
  8: { ring1: 0.40, ring2: 0.15 },
  9: { ring1: 0.60, ring2: 0.30 },
}

function App() {
  const mapRef = useRef(null)
  const mapContainerRef = useRef(null)
  const weightsBtnRef = useRef(null)
  const boroughBtnRef = useRef(null)
  const demandSpillBtnRef = useRef(null)
  const supplySpillBtnRef = useRef(null)

  const [activeTab, setActiveTab] = useState('map')
  const [showH3, setShowH3] = useState(true)
  const [opacity, setOpacity] = useState(0.45)
  const [resolution, setResolution] = useState(7)
  const [pendingResolution, setPendingResolution] = useState(7)
  const [layersReady, setLayersReady] = useState(false)
  const [selectedAmenity, setSelectedAmenity] = useState('')
  const [amenityTypes, setAmenityTypes] = useState([])
  const [amenityCache, setAmenityCache] = useState({})
  const [popCache, setPopCache] = useState({})
  const [jobsCache, setJobsCache] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [darkMode, setDarkMode] = useState(true)
  const [satellite, setSatellite] = useState(false)
  const [usingCache, setUsingCache] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showLanding, setShowLanding] = useState(true)


  const [amenityWeights, setAmenityWeights] = useState(DEFAULT_WEIGHTS)
  const [boroughMultipliers, setBoroughMultipliers] = useState(DEFAULT_BOROUGH_MULTIPLIERS)
  const [minLandFraction, setMinLandFraction] = useState(0.25)
  const [minPopulation, setMinPopulation] = useState(500)
  const [daytimeWeight, setDaytimeWeight] = useState(0.5)
  const [pendingDaytimeWeight, setPendingDaytimeWeight] = useState(0.5)
  const [demandSpillover, setDemandSpillover] = useState(SPILLOVER_DEFAULTS_BY_RES[7])
  const [supplySpillover, setSupplySpillover] = useState(SPILLOVER_DEFAULTS_BY_RES[7])
  const [weightsPopupPos, setWeightsPopupPos] = useState(null)
  const [boroughPopupPos, setBoroughPopupPos] = useState(null)
  const [demandSpillPopupPos, setDemandSpillPopupPos] = useState(null)
  const [supplySpillPopupPos, setSupplySpillPopupPos] = useState(null)
  const [cellMetadata, setCellMetadata] = useState(null)

  const dMinLand = useDebouncedValue(minLandFraction)
  const dMinPop = useDebouncedValue(minPopulation)
  const dDaytimeWeight = useDebouncedValue(daytimeWeight)
  const dAmenityWeights = useDebouncedValue(amenityWeights)
  const dBoroughMultipliers = useDebouncedValue(boroughMultipliers)
  const dDemandSpillover = useDebouncedValue(demandSpillover)
  const dSupplySpillover = useDebouncedValue(supplySpillover)

  const toggleFlyout = (btnRef, currentPos, setPos, closeOthers = []) => {
    if (currentPos) {
      setPos(null)
      return
    }
    closeOthers.forEach(close => close(null))
    const rect = btnRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos({ top: rect.top, left: rect.right + 8 })
  }

  const handleResetView = () => {
    if (!mapRef.current) return
    mapRef.current.flyTo({ center: INITIAL_CENTER, zoom: INITIAL_ZOOM })
  }

  const fetchAndApply = (type) => {
    if (!mapRef.current || !type) return

    const amenities = amenityCache[type]
    if (!amenities) return

    applyAmenityData(mapRef.current, amenities, type)

    if (mapRef.current.getLayer('amenity-points')) mapRef.current.removeLayer('amenity-points')
    if (mapRef.current.getSource('amenity-markers')) mapRef.current.removeSource('amenity-markers')

    const geojson = {
      type: 'FeatureCollection',
      features: amenities
        .filter(p => p.lat && p.lng)
        .map(p => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
          properties: { name: p.name || type }
        }))
    }

    mapRef.current.addSource('amenity-markers', {
      type: 'geojson',
      data: geojson
    })

    mapRef.current.addLayer({
      id: 'amenity-points',
      type: 'circle',
      source: 'amenity-markers',
      minzoom: 13,
      paint: {
        'circle-color': '#B91C1C',
        'circle-radius': 5,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#fff'
      }
    })
  }

  const applyMapStyle = (style, isDark = darkMode) => {
    if (!mapRef.current) return
    setLayersReady(false)
    mapRef.current.setStyle(style)
    mapRef.current.once('style.load', () => {
      loadAllH3Layers(mapRef.current, isDark)
      setLayersReady(true)
      if (selectedAmenity) fetchAndApply(selectedAmenity)
    })
  }

  const handleDarkToggle = () => {
    const newDark = !darkMode
    setDarkMode(newDark)
    if (!satellite) {
      applyMapStyle(newDark ? MAP_STYLES.dark : MAP_STYLES.light, newDark)
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
    
    if (showLanding) return
    
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES.dark,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      minZoom: INITIAL_ZOOM,
      maxBounds: [[-74.55, 40.35], [-73.35, 41.05]],
      renderWorldCopies: false,
    })

    mapRef.current.on('load', () => {
      loadAllH3Layers(mapRef.current, true)
      setLayersReady(true)

      mapRef.current.on('click', 'amenity-points', (e) => {
        e.originalEvent.stopPropagation()
        const f = e.features[0]
        new mapboxgl.Popup()
          .setLngLat(f.geometry.coordinates)
          .setHTML(`<b>${f.properties.name}</b>`)
          .addTo(mapRef.current)
      })

      mapRef.current.on('mouseenter', 'amenity-points', () => (mapRef.current.getCanvas().style.cursor = 'pointer'))
      mapRef.current.on('mouseleave', 'amenity-points', () => (mapRef.current.getCanvas().style.cursor = ''))
    })

    const fetchAmenityPop = async () => {
      setLoading(true)
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

      const cache = {}
      const results = await Promise.all(
        types.map(async (type) => {
          try {
            const res = await fetch(`http://localhost:3001/api/amenities?type=${type}`)
            if (!res.ok) throw new Error('Backend error')
            return { type, data: await res.json() }
          } catch {
            try {
              const fallback = await fetch(`/cache/${type}.json`)
              return { type, data: await fallback.json() }
            } catch {
              console.error(`No data for ${type}`)
              return { type, data: null }
            }
          }
        })
      )

      for (const { type, data } of results) {
        if (data) {
          cache[type] = data
        } else {
          fromCache = true
        }
      }

      setAmenityCache(cache)
      setUsingCache(fromCache)

      // Initialize weights for any new amenity types
      setAmenityWeights(prev => {
        const updated = { ...prev }
        for (const type of types) {
          if (!(type in updated)) updated[type] = 2000
        }
        return updated
      })

      const popData = {}
      const popResults = await Promise.all(
        [7, 8, 9].map(async (res) => {
          try {
            const r = await fetch(`http://localhost:3001/api/population?res=${res}`)
            if (!r.ok) throw new Error('Backend error')
            return { res, data: await r.json() }
          } catch {
            try {
              const fb = await fetch(`/cache/population-res${res}.json`)
              return { res, data: await fb.json() }
            } catch {
              console.error(`No population data for res ${res}`)
              return { res, data: null }
            }
          }
        })
      )

      for (const { res, data } of popResults) {
        if (data) popData[res] = data
      }

      const jobsData = {}
      const jobsResults = await Promise.all(
        [7, 8, 9].map(async (res) => {
          try {
            const r = await fetch(`http://localhost:3001/api/jobs?res=${res}`)
            if (!r.ok) throw new Error('Backend error')
            return { res, data: await r.json() }
          } catch {
            try {
              const fb = await fetch(`/cache/jobs-res${res}.json`)
              return { res, data: await fb.json() }
            } catch {
              console.error(`No jobs data for res ${res}`)
              return { res, data: null }
            }
          }
        })
      )

      for (const { res, data } of jobsResults) {
        if (data) jobsData[res] = data
      }

      // Load cell metadata
      try {
        const metaRes = await fetch('http://localhost:3001/api/cell-metadata')
        if (!metaRes.ok) throw new Error('Backend error')
        const metaData = await metaRes.json()
        setCellMetadata(metaData)
      } catch (err) {
        console.error('Metadata fetch error:', err)
        try {
          const fb = await fetch('/cache/cell-metadata.json')
          setCellMetadata(await fb.json())
        } catch {
          console.error('No cell metadata available')
        }
      }

      setPopCache(popData)
      setJobsCache(jobsData)
      setLoading(false)
    }

    fetchAmenityPop()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [showLanding])


  useEffect(() => {
    if (!layersReady) return
    fetchAndApply(selectedAmenity)
    if (popCache[resolution]) applyPopulationData(mapRef.current, popCache[resolution], resolution)
    if (jobsCache[resolution]) applyJobsData(mapRef.current, jobsCache[resolution], resolution)
  }, [selectedAmenity, layersReady, amenityCache, resolution, popCache, jobsCache])

  useEffect(() => {
    if (!mapRef.current || !layersReady) return
    showResolution(mapRef.current, showH3 ? resolution : null)
  }, [resolution, showH3, layersReady])

  useEffect(() => {
    if (!mapRef.current || !layersReady) return
    setH3Opacity(mapRef.current, opacity)
  }, [opacity, layersReady])

  useEffect(() => {
    if (activeTab !== 'map' || !mapRef.current) return
    requestAnimationFrame(() => mapRef.current?.resize())
  }, [activeTab])

  useEffect(() => {
    const defaults = SPILLOVER_DEFAULTS_BY_RES[resolution]
    if (!defaults) return
    setDemandSpillover(defaults)
    setSupplySpillover(defaults)
  }, [resolution])

  useEffect(() => {
    if (!mapRef.current || !layersReady || !selectedAmenity || !cellMetadata) return
    if (!amenityCache[selectedAmenity] || !popCache[resolution]) return

    const scores = calculateOpportunityScores(
      amenityCache[selectedAmenity],
      popCache[resolution],
      selectedAmenity,
      resolution,
      {
        amenityWeights: dAmenityWeights,
        boroughMultipliers: dBoroughMultipliers,
        minLandFraction: dMinLand,
        minPopulation: dMinPop,
        cellMetadata,
        jobsData: jobsCache[resolution] || [],
        daytimeWeight: dDaytimeWeight,
        demandSpillover: dDemandSpillover,
        supplySpillover: dSupplySpillover,
      }
    )

    applyOpportunityScores(mapRef.current, scores, resolution)
  }, [selectedAmenity, resolution, layersReady, amenityCache, popCache, jobsCache, cellMetadata, dAmenityWeights, dBoroughMultipliers, dMinLand, dMinPop, dDaytimeWeight, dDemandSpillover, dSupplySpillover])


  if (showLanding) 
  {
    return <LandingPage onEnter={() => setShowLanding(false)} />
  }


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


    {activeTab === 'about' && (
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <AboutPage onExplore={() => setActiveTab('map')} />
      </div>
    )}

    {activeTab === 'data' && <DataPage />}


        <aside className="sidebar-panel" style={{display: activeTab === 'map' ? 'flex' : 'none'}}>


          <div className="panel-card">
            <select
              className="amenity-select"
              value={selectedAmenity}
              onChange={(e) => setSelectedAmenity(e.target.value)}
            >
              <option value="">Select Amenity</option>
              {amenityTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
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

          {/* Opportunity Score Panel */}
          <div className="panel-card">
            <h3 className="panel-title italic">Opportunity Score</h3>

            {/* Amenity Weights */}
            <div className="score-row">
              <span className="score-label">Amenity Weights</span>
              <button
                ref={weightsBtnRef}
                className="score-btn"
                onClick={() => toggleFlyout(weightsBtnRef, weightsPopupPos, setWeightsPopupPos, [setBoroughPopupPos, setDemandSpillPopupPos, setSupplySpillPopupPos])}
              >⚙</button>
            </div>

            {/* Borough Multipliers */}
            <div className="score-row">
              <span className="score-label">Borough Multipliers</span>
              <button
                ref={boroughBtnRef}
                className="score-btn"
                onClick={() => toggleFlyout(boroughBtnRef, boroughPopupPos, setBoroughPopupPos, [setWeightsPopupPos, setDemandSpillPopupPos, setSupplySpillPopupPos])}
              >⚙</button>
            </div>

            {/* Demand Spillover */}
            <div className="score-row">
              <span className="score-label">Demand Spillover</span>
              <button
                ref={demandSpillBtnRef}
                className="score-btn"
                onClick={() => toggleFlyout(demandSpillBtnRef, demandSpillPopupPos, setDemandSpillPopupPos, [setWeightsPopupPos, setBoroughPopupPos, setSupplySpillPopupPos])}
              >⚙</button>
            </div>

            {/* Supply Spillover */}
            <div className="score-row">
              <span className="score-label">Supply Spillover</span>
              <button
                ref={supplySpillBtnRef}
                className="score-btn"
                onClick={() => toggleFlyout(supplySpillBtnRef, supplySpillPopupPos, setSupplySpillPopupPos, [setWeightsPopupPos, setBoroughPopupPos, setDemandSpillPopupPos])}
              >⚙</button>
            </div>

            {/* Min Land Fraction */}
            <div className="control-group">
              <label className="control-label">
                Min Land: <input
                  type="number"
                  className="inline-number"
                  min="0" max="100" step="1"
                  value={Math.round(minLandFraction * 100)}
                  onChange={(e) => setMinLandFraction(Math.min(1, Math.max(0, Number(e.target.value) / 100)))}
                />%
              </label>
              <input
                type="range" min="0" max="100" step="1"
                value={Math.round(minLandFraction * 100)}
                onChange={(e) => setMinLandFraction(Number(e.target.value) / 100)}
              />
            </div>

            {/* Min Population */}
            <div className="control-group">
              <label className="control-label">
                Min Population: <input
                  type="number"
                  className="inline-number"
                  min="0" max="50000" step="100"
                  value={minPopulation}
                  onChange={(e) => setMinPopulation(Math.max(0, Number(e.target.value)))}
                />
              </label>
              <input
                type="range" min="0" max="10000" step="100"
                value={minPopulation}
                onChange={(e) => setMinPopulation(Number(e.target.value))}
              />
            </div>

            {/* Daytime Weight */}
            <div className="control-group">
              <label className="control-label">
                Daytime Weight: <input
                  type="number"
                  className="inline-number"
                  min="0" max="100" step="1"
                  value={Math.round(pendingDaytimeWeight * 100)}
                  onChange={(e) => {
                    const v = Math.min(1, Math.max(0, Number(e.target.value) / 100))
                    setPendingDaytimeWeight(v)
                    setDaytimeWeight(v)
                  }}
                />%
              </label>
              <input
                type="range" min="0" max="100" step="1"
                value={Math.round(pendingDaytimeWeight * 100)}
                onChange={(e) => setPendingDaytimeWeight(Number(e.target.value) / 100)}
                onMouseUp={() => setDaytimeWeight(pendingDaytimeWeight)}
                onTouchEnd={() => setDaytimeWeight(pendingDaytimeWeight)}
              />
              <span className="filter-coming-soon">0% = residents only · 100% = workers only</span>
            </div>
          </div>

          <div className="panel-card">
            <h3 className="panel-title italic">Data Filters</h3>

            <div className="control-group">
              <label className="control-label">Population Density</label>
              <input type="range" min="0" max="100" step="1" disabled />
              <span className="filter-coming-soon">Coming soon</span>
            </div>

            <div className="control-group">
              <label className="control-label">Competitors per Cell</label>
              <input type="range" min="0" max="100" step="1" disabled />
              <span className="filter-coming-soon">Coming soon</span>
            </div>

            <div className="control-group">
              <label className="control-label">Opportunity Score</label>
              <input type="range" min="0" max="100" step="1" disabled />
              <span className="filter-coming-soon">Coming soon</span>
            </div>
          </div>

          <div className="panel-card">
            <h3 className="panel-title italic">Map Controls</h3>

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

        <main className="map-area" style={{display: activeTab === 'map' ? 'flex' : 'none'}}>

          <div id="map-container" ref={mapContainerRef} />
          {selectedAmenity && (
            <div className="map-legend">
              <div className="legend-title">Opportunity Score</div>
              <div className="legend-items">
                <div className="legend-item">
                  <div className="legend-swatch" style={{background: '#1a9850'}}></div>
                  <span>High opportunity</span>
                </div>
                <div className="legend-item">
                  <div className="legend-swatch" style={{background: '#91cf60'}}></div>
                  <span>Good opportunity</span>
                </div>
                <div className="legend-item">
                  <div className="legend-swatch" style={{background: '#fee08b'}}></div>
                  <span>Moderate</span>
                </div>
                <div className="legend-item">
                  <div className="legend-swatch" style={{background: '#fc8d59'}}></div>
                  <span>Low opportunity</span>
                </div>
                <div className="legend-item">
                  <div className="legend-swatch" style={{background: '#67001f'}}></div>
                  <span>Saturated</span>
                </div>
                <div className="legend-divider"></div>
                <div className="legend-item">
                  <div className="legend-swatch" style={{background: '#888'}}></div>
                  <span>Excluded</span>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="cache-warning loading">
              ⏳ Loading amenity data...
            </div>
          )}
          {!loading && usingCache && (
            <div className="cache-warning">
              ⚠ Using cached data — live database is currently unavailable.
            </div>
          )}
        </main>
      </div>

      {/* Amenity Weights Popup */}
      {weightsPopupPos && (
        <div className="popup-flyout" style={{ top: weightsPopupPos.top, left: weightsPopupPos.left }}>
          <div className="popup-modal">
            <div className="popup-header">
              <h3>Amenity Weights</h3>
              <button className="popup-close" onClick={() => setWeightsPopupPos(null)}>✕</button>
            </div>
            <p className="popup-desc">People per 1 amenity (ideal ratio)</p>
            {Object.entries(amenityWeights).map(([type, value]) => (
              <div className="popup-slider-group" key={type}>
                <label className="popup-label">
                  {type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </label>
                <div className="popup-input-row">
                  <input
                    type="range" min="500" max="10000" step="100"
                    value={value}
                    onChange={(e) => setAmenityWeights(prev => ({ ...prev, [type]: Number(e.target.value) }))}
                  />
                  <input
                    type="number"
                    className="popup-number"
                    min="100" max="50000" step="100"
                    value={value}
                    onChange={(e) => setAmenityWeights(prev => ({ ...prev, [type]: Number(e.target.value) }))}
                  />
                </div>
              </div>
            ))}
            <button className="reset-btn" onClick={() => setAmenityWeights(DEFAULT_WEIGHTS)}>
              Reset Defaults
            </button>
          </div>
        </div>
      )}

      {/* Borough Multipliers Popup */}
      {boroughPopupPos && (
        <div className="popup-flyout" style={{ top: boroughPopupPos.top, left: boroughPopupPos.left }}>
          <div className="popup-modal">
            <div className="popup-header">
              <h3>Borough Multipliers</h3>
              <button className="popup-close" onClick={() => setBoroughPopupPos(null)}>✕</button>
            </div>
            <p className="popup-desc">Population demand multiplier per borough</p>
            {Object.entries(boroughMultipliers).map(([borough, value]) => (
              <div className="popup-slider-group" key={borough}>
                <label className="popup-label">{borough}</label>
                <div className="popup-input-row">
                  <input
                    type="range" min="0.1" max="5.0" step="0.1"
                    value={value}
                    onChange={(e) => setBoroughMultipliers(prev => ({ ...prev, [borough]: Number(e.target.value) }))}
                  />
                  <input
                    type="number"
                    className="popup-number"
                    min="0.1" max="10" step="0.1"
                    value={value}
                    onChange={(e) => setBoroughMultipliers(prev => ({ ...prev, [borough]: Number(e.target.value) }))}
                  />
                </div>
              </div>
            ))}
            <button className="reset-btn" onClick={() => setBoroughMultipliers(DEFAULT_BOROUGH_MULTIPLIERS)}>
              Reset Defaults
            </button>
          </div>
        </div>
      )}

      {/* Demand Spillover Popup */}
      {demandSpillPopupPos && (
        <div className="popup-flyout" style={{ top: demandSpillPopupPos.top, left: demandSpillPopupPos.left }}>
          <div className="popup-modal">
            <div className="popup-header">
              <h3>Demand Spillover</h3>
              <button className="popup-close" onClick={() => setDemandSpillPopupPos(null)}>✕</button>
            </div>
            <p className="popup-desc">How much population/workers from neighbor cells count toward this cell's demand</p>
            {['ring1', 'ring2'].map((ring) => (
              <div className="popup-slider-group" key={ring}>
                <label className="popup-label">{ring === 'ring1' ? 'Ring 1 (adjacent)' : 'Ring 2 (next out)'}</label>
                <div className="popup-input-row">
                  <input
                    type="range" min="0" max="1" step="0.05"
                    value={demandSpillover[ring]}
                    onChange={(e) => setDemandSpillover(prev => ({ ...prev, [ring]: Number(e.target.value) }))}
                  />
                  <input
                    type="number"
                    className="popup-number"
                    min="0" max="1" step="0.05"
                    value={demandSpillover[ring]}
                    onChange={(e) => setDemandSpillover(prev => ({ ...prev, [ring]: Number(e.target.value) }))}
                  />
                </div>
              </div>
            ))}
            <button className="reset-btn" onClick={() => setDemandSpillover(SPILLOVER_DEFAULTS_BY_RES[resolution])}>
              Reset Defaults
            </button>
          </div>
        </div>
      )}

      {/* Supply Spillover Popup */}
      {supplySpillPopupPos && (
        <div className="popup-flyout" style={{ top: supplySpillPopupPos.top, left: supplySpillPopupPos.left }}>
          <div className="popup-modal">
            <div className="popup-header">
              <h3>Supply Spillover</h3>
              <button className="popup-close" onClick={() => setSupplySpillPopupPos(null)}>✕</button>
            </div>
            <p className="popup-desc">How much amenities in neighbor cells count toward this cell's supply</p>
            {['ring1', 'ring2'].map((ring) => (
              <div className="popup-slider-group" key={ring}>
                <label className="popup-label">{ring === 'ring1' ? 'Ring 1 (adjacent)' : 'Ring 2 (next out)'}</label>
                <div className="popup-input-row">
                  <input
                    type="range" min="0" max="1" step="0.05"
                    value={supplySpillover[ring]}
                    onChange={(e) => setSupplySpillover(prev => ({ ...prev, [ring]: Number(e.target.value) }))}
                  />
                  <input
                    type="number"
                    className="popup-number"
                    min="0" max="1" step="0.05"
                    value={supplySpillover[ring]}
                    onChange={(e) => setSupplySpillover(prev => ({ ...prev, [ring]: Number(e.target.value) }))}
                  />
                </div>
              </div>
            ))}
            <button className="reset-btn" onClick={() => setSupplySpillover(SPILLOVER_DEFAULTS_BY_RES[resolution])}>
              Reset Defaults
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App