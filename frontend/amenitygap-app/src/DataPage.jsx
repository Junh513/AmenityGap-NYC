import { useEffect, useRef, useState } from 'react'
import './DataPage.css'

const SUPABASE_KEY = 'sb_publishable_gmNphTKfAOJ41tebwvCVdg_ezjFpOog'
const SUPABASE_BASE = 'https://wnjgkoxtbfqdvoydyszj.supabase.co/rest/v1'

const DATASETS = [
  {
    name: 'OSM Amenities',
    source: 'OpenStreetMap',
    updated: 'Apr 2026',
    coverage: 'All Amenity Types',
    tag: 'amenities',
    downloads: [
      { label: 'Download (JSON)', url: `${SUPABASE_BASE}/amenities?select=*&apikey=${SUPABASE_KEY}`, filename: 'osm_amenities.json' },
    ],
    sourceUrl: 'https://www.openstreetmap.org/',
  },
  {
    name: 'NYC Census Tracts',
    source: 'NYC Open Data',
    updated: 'Apr 2026',
    coverage: 'Demographics',
    tag: 'demographics',
    downloads: [
      { label: 'Download (JSON)', url: 'https://data.cityofnewyork.us/api/views/63ge-mke6/rows.json?accessType=DOWNLOAD', filename: 'nyc_census_tracts.json' },
    ],
    sourceUrl: 'https://data.cityofnewyork.us/City-Government/2020-Census-Tracts/63ge-mke6/about_data',
  },
  {
    name: '2020 US Census',
    source: 'Census Bureau API',
    updated: 'Apr 2026',
    coverage: 'Population Data',
    tag: 'population',
    downloads: [
      { label: 'Download (JSON)', url: 'https://api.census.gov/data/2020/dec/pl?get=NAME,P1_001N&for=tract:*&in=state:36', filename: 'census_2020_nyc.json' },
    ],
    sourceUrl: 'https://www.census.gov/data/developers/data-sets/decennial-census.html',
  },
  {
    name: 'H3 Population Grid',
    source: 'AmenityGap ETL',
    updated: 'Apr 2026',
    coverage: 'Population per H3 Cell',
    tag: 'spatial',
    downloads: [
      { label: 'Download Res 7 (JSON)', url: `${SUPABASE_BASE}/h3_population_res7?select=*&apikey=${SUPABASE_KEY}`, filename: 'h3_population_res7.json' },
      { label: 'Download Res 8 (JSON)', url: `${SUPABASE_BASE}/h3_population_res8?select=*&apikey=${SUPABASE_KEY}`, filename: 'h3_population_res8.json' },
      { label: 'Download Res 9 (JSON)', url: `${SUPABASE_BASE}/h3_population_res9?select=*&apikey=${SUPABASE_KEY}`, filename: 'h3_population_res9.json' },
    ],
    sourceUrl: 'https://github.com/Junh513/AmenityGap-NYC',
  },
  {
    name: 'LEHD Job Data',
    source: 'US Census LEHD',
    updated: 'Apr 2026',
    coverage: 'Worker Daytime Population',
    tag: 'workforce',
    downloads: [
      { label: 'Download Res 7 (JSON)', url: `${SUPABASE_BASE}/h3_jobs_res7?select=*&apikey=${SUPABASE_KEY}`, filename: 'h3_jobs_res7.json' },
      { label: 'Download Res 8 (JSON)', url: `${SUPABASE_BASE}/h3_jobs_res8?select=*&apikey=${SUPABASE_KEY}`, filename: 'h3_jobs_res8.json' },
      { label: 'Download Res 9 (JSON)', url: `${SUPABASE_BASE}/h3_jobs_res9?select=*&apikey=${SUPABASE_KEY}`, filename: 'h3_jobs_res9.json' },
    ],
    sourceUrl: 'https://lehd.ces.census.gov/data/',
  },
]

async function downloadDataset(url, filename) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objUrl)
  } catch (err) {
    console.error('Download failed:', err)
    alert(`Download failed: ${err.message}`)
  }
}

export default function DataPage() {
  const terminalBodyRef = useRef(null)
  const [openDropdown, setOpenDropdown] = useState(null)

  useEffect(() => {
    const lines = [
      { text: '$ connecting to data sources...', color: 'rgba(122,184,176,0.6)' },
      { text: '✓ osm_amenities.csv — 142,000 rows loaded', color: '#7ab8b0' },
      { text: '✓ h3_population_grid.csv — 84,500 rows loaded', color: '#7ab8b0' },
      { text: '✓ us_census_2020.csv — 38,200 rows loaded', color: '#7ab8b0' },
      { text: '✓ lehd_job_data.csv — 22,800 rows loaded', color: '#7ab8b0' },
      { text: '✓ nyc_census_tracts.csv — 2,200 rows loaded', color: '#7ab8b0' },
      { text: '→ all datasets ready for viewing', color: 'rgba(168,213,206,0.9)' },
    ]

    const delays = [0, 600, 1200, 1800, 2300, 2750, 3200]

    const body = terminalBodyRef.current
    if (!body) return

    const timeouts = []

    function typewriterLine(el, text, color) {
      let i = 0
      el.style.color = color
      const interval = setInterval(() => {
        el.textContent = text.slice(0, i)
        i++
        if (i > text.length) clearInterval(interval)
      }, 28)
    }

    function runLines() {
      lines.forEach((line, i) => {
        const t = setTimeout(() => {
          const el = document.createElement('div')
          el.className = 'data-terminal-line'
          body.appendChild(el)
          typewriterLine(el, line.text, line.color)
        }, delays[i])
        timeouts.push(t)
      })
    }

    runLines()

    const restartT = setTimeout(() => {
      body.innerHTML = ''
      runLines()
    }, 6500)
    timeouts.push(restartT)

    return () => timeouts.forEach(clearTimeout)
  }, [])

  return (
    <div className="data-page">
      <section className="data-hero">
        <div className="data-hero-content">
          <div className="data-hero-eyebrow">Open Data</div>
          <h1 className="data-hero-title">The Data Behind AmenityGap</h1>
          <p className="data-hero-desc">
            All datasets powering AmenityGap NYC are publicly available and free to use.
            Browse any table below for your own research or analysis, no signup required.
          </p>
        </div>

        <div className="data-terminal">
          <div className="data-terminal-header">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
            <span className="data-terminal-title">amenitygap — data loader</span>
          </div>
          <div className="data-terminal-body" ref={terminalBodyRef} />
        </div>
      </section>

      <section className="data-table-section">
        <div className="data-section-title">Available Datasets</div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Source</th>
                <th>Last Updated</th>
                <th>Coverage</th>
                <th>View</th>
              </tr>
            </thead>
            <tbody>
              {DATASETS.map((d) => (
                <tr key={d.name}>
                  <td className="data-td-name">{d.name}</td>
                  <td>{d.source}</td>
                  <td>{d.updated}</td>
                  <td>
                    <span className={`data-tag data-tag--${d.tag}`}>{d.coverage}</span>
                  </td>
                  <td>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        className="data-dl-btn"
                        onClick={() =>
                          setOpenDropdown(openDropdown === d.name ? null : d.name)
                        }
                      >
                        ↗ View Data ▾
                      </button>

                      {openDropdown === d.name && (
                        <div className="data-dropdown">
                          {d.downloads?.map((u) => (
                            <button
                              key={u.label}
                              type="button"
                              className="data-dropdown-item"
                              onClick={() => {
                                downloadDataset(u.url, u.filename)
                                setOpenDropdown(null)
                              }}
                            >
                              ↓ {u.label}
                            </button>
                          ))}
                          {d.sourceUrl && (
                            <a
                              href={d.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => setOpenDropdown(null)}
                            >
                              ↗ View Source
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="data-disclaimer">
          <span className="data-disclaimer-icon">⚠</span>
          <p>
            <strong>Data Disclaimer:</strong> We cannot guarantee this dataset is fully complete
            or up to date. Businesses open and close every day in NYC and our data may not reflect
            the most recent changes.
          </p>
        </div>
      </section>
    </div>
  )
}
