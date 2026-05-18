import './landingPage.css'
import skylineImg from './assets/nyc-skyline.png'
import logoImg from './assets/amenity-logo.png'

export default function LandingPage({ onEnter }) {
  return (
    <div className="landing-shell">
      <div className="skyline-wrap">
          <img src={skylineImg} alt="NYC skyline" className="skyline-image" />
      </div>

      <div className="landing-overlay">
        <h1 className="landing-title">AmenityGap NYC</h1>
        <img src={logoImg} alt="AmenityGap NYC logo" className="landing-logo" />
        <p className="landing-tagline">Bridging the Gap — Raw Urban Data to Business Opportunity</p>

        <button className="landing-cta" onClick={onEnter}>
          Learn More →
        </button>
      </div>

      <div className="landing-fade-bottom" />
    </div>
  )
}
