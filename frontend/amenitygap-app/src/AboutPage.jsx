import { useEffect, useRef } from 'react'
import './AboutPage.css'

export default function AboutPage({ onExplore }) {

  // refs for the canvas and the two sections that have scroll animations
  const canvasRef = useRef(null)
  const howItWorksRef = useRef(null)
  const etlRef = useRef(null)


  // ── CANVAS ANIMATION ──────────────────────────────────────────────
  // draws the animated hex grid across the hero section
  // runs on mount and cleans up when the component unmounts
  useEffect(() => {

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animFrame

    // sets the canvas pixel dimensions to match its CSS size
    // multiplied by devicePixelRatio so it looks sharp on retina screens
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener('resize', resize)

    // draws a single hexagon at (cx, cy) with a given size and color
    // the angle offset rotates the hex so flat sides face top/bottom
    // shadowBlur is reset to 0 after each stroke so the glow doesnt bleed into other shapes
    function drawHex(cx, cy, size, r, g, b, opacity) {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6
        const x = cx + size * Math.cos(angle)
        const y = cy + size * Math.sin(angle)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.closePath()

      ctx.fillStyle = `rgba(${r},${g},${b},${opacity * 0.45})`   // low opacity fill
      ctx.shadowBlur = 0
      ctx.fill()

      ctx.strokeStyle = `rgba(${r},${g},${b},${Math.min(opacity * 1.2, 1)})`
      ctx.lineWidth = 1.5
      ctx.shadowColor = `rgba(${r},${g},${b},0.7)`
      ctx.shadowBlur = 6                                          // subtle glow on the outline
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    // helper functions to get the canvas CSS width/height
    // called as functions so they always return the current size, not a stale snapshot
    const W = () => canvas.offsetWidth
    const H = () => canvas.offsetHeight

    // each entry is one hex: [xFrac, yFrac, size, r, g, b, pulseSpeed, pulseOffset]
    // xFrac/yFrac are 0.0–1.0 fractions of the canvas size
    // hexes go left to right: greens → yellows → reds, matching the opportunity score color scale
    const hexData = [
      // left cluster — greens (high opportunity)
      [0.04, 0.30, 32, 26, 152, 80, 1.8, 0],
      [0.10, 0.22, 34, 26, 152, 80, 2.1, 0.3],
      [0.10, 0.44, 32, 26, 152, 80, 1.6, 0.8],
      [0.16, 0.30, 34, 145, 207, 96, 2.3, 0.5],
      [0.16, 0.52, 30, 26, 152, 80, 1.9, 1.2],
      [0.22, 0.22, 32, 0, 104, 55, 2.0, 0.2],
      [0.22, 0.44, 34, 145, 207, 96, 1.7, 0.9],
      [0.28, 0.30, 32, 26, 152, 80, 2.2, 0.4],
      [0.28, 0.52, 30, 91, 207, 96, 1.8, 1.5],
      [0.34, 0.22, 30, 217, 239, 139, 2.4, 0.7],

      // center — yellows/neutrals
      [0.34, 0.44, 34, 255, 255, 191, 1.9, 0.1],
      [0.40, 0.30, 32, 253, 174, 97, 2.1, 0.6],
      [0.40, 0.52, 30, 255, 255, 191, 1.6, 1.1],
      [0.46, 0.22, 32, 244, 109, 67, 2.3, 0.3],
      [0.46, 0.44, 34, 253, 174, 97, 1.8, 0.8],

      // right cluster — reds (oversupplied)
      [0.52, 0.30, 32, 215, 48, 39, 2.0, 0.2],
      [0.52, 0.52, 30, 244, 109, 67, 2.2, 0.7],
      [0.58, 0.22, 34, 215, 48, 39, 1.7, 1.3],
      [0.58, 0.44, 32, 103, 0, 31, 2.4, 0.4],
      [0.58, 0.60, 30, 215, 48, 39, 1.9, 0.9],
      [0.64, 0.30, 34, 103, 0, 31, 2.1, 0.1],
      [0.64, 0.52, 32, 215, 48, 39, 1.6, 1.0],
      [0.70, 0.22, 30, 103, 0, 31, 2.3, 0.5],
      [0.70, 0.44, 34, 103, 0, 31, 2.0, 0.6],
      [0.70, 0.60, 30, 244, 109, 67, 1.8, 1.4],
      [0.76, 0.30, 32, 215, 48, 39, 2.2, 0.2],
      [0.76, 0.52, 30, 103, 0, 31, 1.9, 0.8],
      [0.82, 0.22, 30, 103, 0, 31, 2.1, 0.3],
      [0.82, 0.44, 32, 215, 48, 39, 1.7, 1.1],
      [0.88, 0.35, 30, 103, 0, 31, 2.0, 0.7],
      [0.88, 0.55, 28, 180, 30, 50, 1.9, 0.4],
      [0.92, 0.25, 28, 140, 20, 60, 2.1, 0.6],
      [0.92, 0.45, 26, 200, 70, 30, 1.7, 1.0],
      [0.95, 0.35, 24, 160, 40, 40, 2.0, 0.2],
      [0.95, 0.55, 22, 120, 15, 45, 1.8, 0.8],
    ]

    // each entry is one pulsing dot: [xFrac, yFrac, r, g, b, pulseSpeed, pulseOffset]
    // dots sit on top of hexes or near borough labels to add visual detail
    // to place a dot near a label: xFrac = label's left% / 100 - 0.03, yFrac = label's top% / 100
    const dotData = [
      [0.10, 0.22, 144, 238, 144, 1.5, 0],     // on green hex
      [0.39, 0.50, 255, 200, 0,   2.0, 0.5],   // on orange hex
      [0.58, 0.42, 255, 60,  60,  1.8, 1.0],   // on red hex
      [0.70, 0.56, 196, 85,  8,   1.6, 0.8],   // on dark red hex
      [0.21, 0.21, 0,   255, 136, 1.6, 0.2],   // near MANHATTAN label
      [0.47, 0.20, 255, 220, 50,  1.9, 0.7],   // near BRONX label
      [0.77, 0.27, 140, 0,   0,   1.7, 0.4],   // near QUEENS label
      [0.88, 0.58, 255, 253, 116, 2.0, 1.1],   // near BROOKLYN label
      [0.16, 0.55, 0,   255, 136, 1.8, 0.6],   // near STATEN ISLAND label
    ]

    // t increments every frame and drives all the sine wave pulse animations
    // each hex/dot gets a different pulseSpeed and pulseOffset so they dont all pulse together
    let t = 0

    function animate() {
      const w = W(), h = H()
      ctx.clearRect(0, 0, w, h)
      t += 0.016

      // very faint grid lines for a data/map aesthetic — opacity kept low so hexes stay dominant
      ctx.strokeStyle = 'rgba(95,158,160,0.07)'
      ctx.lineWidth = 0.5
      ctx.shadowBlur = 0
      for (let x = 0; x < w; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
      }
      for (let y = 0; y < h; y += 50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
      }

      // draw each hex with its current pulse opacity calculated from the sine wave
      hexData.forEach(([xf, yf, size, r, g, b, spd, off]) => {
        const pulse = 0.55 + 0.45 * Math.sin(t * spd + off)
        drawHex(xf * w, yf * h, size, r, g, b, pulse)
      })

      // draw each dot with two layers: an expanding ripple ring + a solid glowing core
      dotData.forEach(([xf, yf, r, g, b, spd, off]) => {
        const cx = xf * w
        const cy = yf * h
        const pulse = 0.5 + 0.5 * Math.sin(t * spd + off)

        // ripple ring — expands outward and fades out as pulse increases
        ctx.beginPath()
        ctx.arc(cx, cy, 3 + 9 * pulse, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r},${g},${b},${0.12 * (1 - pulse)})`
        ctx.shadowBlur = 0
        ctx.fill()

        // core dot — solid center with a glow
        ctx.beginPath()
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.shadowColor = `rgba(${r},${g},${b},0.9)`
        ctx.shadowBlur = 8
        ctx.fill()
        ctx.shadowBlur = 0
      })

      animFrame = requestAnimationFrame(animate)
    }

    animate()

    // cancel the animation and remove the resize listener when the component unmounts
    return () => {
      cancelAnimationFrame(animFrame)
      window.removeEventListener('resize', resize)
    }
  }, [])


  // ── SCROLL ANIMATIONS ─────────────────────────────────────────────
  // watches the How It Works and ETL sections
  // when a section scrolls into view, it adds the 'visible' class to each
  // animatable item with a staggered delay so they slide in one by one
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return

          const items = entry.target.querySelectorAll('.about-step, .etl-node, .etl-arrow')

          // stagger the items: 0ms, 150ms, 300ms, etc.
          items.forEach((item, index) => {
            setTimeout(() => {
              item.classList.add('visible')
            }, index * 150)
          })

          // stop watching once the animation has fired — no need to repeat
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.2 }   // fires when 20% of the section enters the viewport
    )

    if (howItWorksRef.current) observer.observe(howItWorksRef.current)
    if (etlRef.current) observer.observe(etlRef.current)

    return () => observer.disconnect()
  }, [])


  // ── JSX ───────────────────────────────────────────────────────────
  // page is divided into three main sections:
  // 1. hero — animated canvas with hexes, borough labels, title, legend
  // 2. stats row — four key numbers about the dataset
  // 3. main content — cards, how it works, data sources, ETL pipeline, CTA
  return (
    <div className="about-page">

      {/* ── HERO ── */}
      <section className="about-hero">

        {/* canvas fills the entire hero behind everything else */}
        <canvas ref={canvasRef} className="about-hero-canvas" />

        {/* borough labels are absolutely positioned using inline left/top % styles
            to move a label just change its left and top values */}
        <div className="about-borough-labels">
          <span style={{ left: '25%', top: '19%' }}>MANHATTAN</span>
          <span style={{ left: '51%', top: '20%' }}>BRONX</span>
          <span style={{ left: '80%', top: '22%' }}>QUEENS</span>
          <span style={{ left: '92%', top: '58%' }}>BROOKLYN</span>
          <span style={{ left: '21%', top: '58%' }}>STATEN ISLAND</span>
        </div>

        {/* main title sits in the lower center of the hero via CSS margin-top */}
        <div className="about-hero-content">
          <h1 className="about-hero-title">AmenityGap NYC</h1>
        </div>

        {/* legend strip at the very bottom explains the color scale
            colors match the hex colors in hexData and in h3Layer.js */}
        <div className="about-hero-legend">
          <span className="legend-dot" style={{ background: '#1a9850' }} /> High Opportunity
          <span className="legend-dot" style={{ background: '#ffffbf', marginLeft: 16 }} /> Neutral
          <span className="legend-dot" style={{ background: '#d73027', marginLeft: 16 }} /> Oversupplied
          <span className="legend-dot" style={{ background: 'rgba(80,80,80,0.6)', marginLeft: 16 }} /> Excluded
        </div>
      </section>


      {/* ── STATS ROW ── */}
      {/* dark teal band with four key dataset numbers, separated by thin dividers */}
      <section className="about-stats-row">
        <div className="about-stat">
          <span className="about-stat-num">8.8M</span>
          <span className="about-stat-label">NYC Residents Covered</span>
        </div>
        <div className="about-stat-divider" />
        <div className="about-stat">
          <span className="about-stat-num">5</span>
          <span className="about-stat-label">NYC Boroughs</span>
        </div>
        <div className="about-stat-divider" />
        <div className="about-stat">
          <span className="about-stat-num">6+</span>
          <span className="about-stat-label">Amenity Types Tracked</span>
        </div>
        <div className="about-stat-divider" />
        <div className="about-stat">
          <span className="about-stat-num">3</span>
          <span className="about-stat-label">H3 Grid Resolutions</span>
        </div>
      </section>


      {/* ── MAIN CONTENT ── */}
      <section className="about-main">

        {/* three equal cards: Problem / Solution / Who It's For */}
        <div className="about-cards">
          <div className="about-card">
            <h3 className="about-card-title">The Problem</h3>
            <div className="about-card-divider" />
            <p className="about-card-text">
              Many NYC neighborhoods lack access to everyday services like laundromats, pharmacies, and delis relative to their population size. This creates invisible service deserts that affect residents and make it harder to identify business opportunities for entrepreneurs.
            </p>
          </div>
          <div className="about-card">
            <h3 className="about-card-title">Our Solution</h3>
            <div className="about-card-divider" />
            <p className="about-card-text">
              We combine OpenStreetMap amenity data with U.S. Census population data to analyze service access across NYC neighborhoods. Using Uber's H3 grid system, our platform calculates opportunity scores for different areas and visualizes underserved neighborhoods through an interactive heat map.
            </p>
          </div>
          <div className="about-card">
            <h3 className="about-card-title">Who It's For</h3>
            <div className="about-card-divider" />
            <p className="about-card-text">
              AmenityGap NYC is designed for entrepreneurs, small business owners, NYC residents, and urban planners who want a better understanding of service access across different neighborhoods.
            </p>
          </div>
        </div>


        {/* two column grid: How It Works on the left, Data Sources on the right */}
        <div className="about-bottom-grid">

          {/* HOW IT WORKS — four numbered steps connected by a vertical line
              steps start invisible and slide in when the section scrolls into view
              ref is attached so the IntersectionObserver knows what to watch */}
          <div className="about-howit" ref={howItWorksRef}>
            <h2 className="about-section-title">How It Works</h2>
            <div className="about-steps">
              <div className="about-step">
                <div className="about-step-circle">1</div>
                <div className="about-step-line" />
                <div className="about-step-content">
                  <div className="about-step-title">Collect</div>
                  <div className="about-step-text">We pull amenity and infrastructure data from OpenStreetMap and population data from the US Census Bureau.</div>
                </div>
              </div>
              <div className="about-step">
                <div className="about-step-circle">2</div>
                <div className="about-step-line" />
                <div className="about-step-content">
                  <div className="about-step-title">Index</div>
                  <div className="about-step-text">We map all data onto Uber's H3 hexagonal grid at three resolution levels — city, neighborhood, and block scale.</div>
                </div>
              </div>
              <div className="about-step">
                <div className="about-step-circle">3</div>
                <div className="about-step-line" />
                <div className="about-step-content">
                  <div className="about-step-title">Score</div>
                  <div className="about-step-text">Our algorithm calculates an opportunity score for each hex cell, weighing population demand against existing supply.</div>
                </div>
              </div>
              <div className="about-step">
                <div className="about-step-circle">4</div>
                <div className="about-step-line about-step-line--last" />
                <div className="about-step-content">
                  <div className="about-step-title">Visualize</div>
                  <div className="about-step-text">Results are rendered on an interactive Mapbox heatmap — green cells show high opportunity, red cells show oversaturated areas.</div>
                </div>
              </div>
            </div>
          </div>

          {/* DATA SOURCES — four sources each with a colored dot and short description */}
          <div className="about-datasources">
            <h2 className="about-section-title">Data Sources</h2>
            <div className="about-source-cards">
              <div className="about-source">
                <div className="about-source-dot" style={{ background: '#126565' }} />
                <div>
                  <div className="about-source-name">OpenStreetMap</div>
                  <div className="about-source-desc">Amenity locations across all five boroughs: laundromats, pharmacies, delis, barbers, gas stations, and more.</div>
                </div>
              </div>
              <div className="about-source">
                <div className="about-source-dot" style={{ background: '#126565' }} />
                <div>
                  <div className="about-source-name">US Census Bureau</div>
                  <div className="about-source-desc">2020 Census population data, interpolated onto the H3 grid using area-weighted averaging.</div>
                </div>
              </div>
              <div className="about-source">
                <div className="about-source-dot" style={{ background: '#126565' }} />
                <div>
                  <div className="about-source-name">Uber H3</div>
                  <div className="about-source-desc">Hexagonal hierarchical spatial indexing system that divides NYC into uniform grid cells at three resolution levels.</div>
                </div>
              </div>
              <div className="about-source">
                <div className="about-source-dot" style={{ background: '#126565' }} />
                <div>
                  <div className="about-source-name">LEHD + MTA</div>
                  <div className="about-source-desc">Longitudinal Employer-Household Dynamics data and MTA turnstile usage for daytime population weighting.</div>
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* ETL PIPELINE — shows the five stages data goes through before reaching the frontend
            nodes and arrows animate in on scroll via the IntersectionObserver above */}
        <div style={{ marginTop: 1 }} ref={etlRef}>
          <div className="about-section-title" style={{ marginBottom: 12 }}>ETL Pipeline</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {[
              { name: 'OSM Overpass',  desc: 'Extract amenities' },
              { name: 'Census Bureau', desc: 'Extract population' },
              { name: 'etl.py',        desc: 'Clean + H3 index' },
              { name: 'Supabase',      desc: 'Store tables' },
              { name: 'FastAPI',       desc: 'Serve to frontend' },
            ].map((step, i, arr) => (
              <div key={step.name} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div className="etl-node" style={{
                  flex: 1,
                  background: '#1a3d38',
                  borderRadius: 10,
                  padding: '12px 8px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '0.80rem', fontWeight: 'bold', color: '#e3f0ed' }}>{step.name}</div>
                  <div style={{ fontSize: '0.70rem', color: '#bbc9be', marginTop: 3 }}>{step.desc}</div>
                </div>
                {/* arrow between nodes — hidden after the last one */}
                {i < arr.length - 1 && (
                  <div className="etl-arrow" style={{ color: '#3d7a7c', fontSize: '1.1rem', padding: '0 6px', flexShrink: 0 }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>


        {/* CTA BAND — sits at the bottom, button calls onExplore to switch to the Map tab */}
        <div className="about-cta-band">
          <div className="about-cta-text">
            <h3>Ready to explore NYC's opportunity gaps?</h3>
            <p>Select an amenity type and browse the interactive H3 heatmap to find underserved neighborhoods.</p>
          </div>
          <button className="about-cta-btn" onClick={onExplore}>
            Explore the Map →
          </button>
        </div>

      </section>
    </div>
  )
}