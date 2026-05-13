import { useEffect, useRef } from 'react'
import './DataPage.css'

const DATASETS = [
  {
    name: 'OSM Amenities',
    source: 'OpenStreetMap',
    updated: 'Apr 2026',
    coverage: 'All Amenity Types',
    tag: 'amenities',
    url: '',
  },
  {
    name: 'NYC Census Tracts',
    source: 'NYC Open Data',
    updated: 'Apr 2026',
    coverage: 'Demographics',
    tag: 'demographics',
    url: '',
  },
  {
    name: '2020 US Census',
    source: 'Census Bureau API',
    updated: 'Apr 2026',
    coverage: 'Population Data',
    tag: 'population',
    url: '',
  },
  {
    name: 'H3 Population Grid',
    source: 'AmenityGap ETL',
    updated: 'Apr 2026',
    coverage: 'Population per H3 Cell',
    tag: 'spatial',
    url: '',
  },
  {
    name: 'LEHD Job Data',
    source: 'US Census LEHD',
    updated: 'Apr 2026',
    coverage: 'Worker Daytime Population',
    tag: 'workforce',
    url: '',
  },
]

export default function DataPage() {
  const terminalBodyRef = useRef(null)

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
                    <a
                      className="data-dl-btn"
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      ↗ View Data
                    </a>
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
