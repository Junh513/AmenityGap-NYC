import './landingPage.css'
import skylineImg from './assets/nyc-skyline.png'

export default function LandingPage({ onEnter }) {
  
  return (
    <div className="landing-shell">   
{/* NYC skyline image sits at the bottom of the screen as the background */}
      <div className="skyline-wrap">
          <img src={skylineImg} alt="NYC skyline" className="skyline-image" />
      </div>
      
{/* Center overlay: logo, tagline, and enter button stacked on top of the skyline */}
      <div className="landing-overlay">
        <h1 className="landing-title">AmenityGap NYC</h1>
        <p className="landing-tagline">Bridging the Gap — Raw Urban Data to Business Opportunity</p>

{/* Clicking this calls onEnter which switches the view to the main app */}
        <button className="landing-cta" onClick={onEnter}>
          Explore the Map →
        </button>
      </div>

{/* Gradient fade at the bottom so the skyline blends into the page smoothly */}
      <div className="landing-fade-bottom" />
    </div>
  )
}
