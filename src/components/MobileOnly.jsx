import "./MobileOnly.css";
import phoneImage from "../assets/IOS Phone.png";

function MobileOnly({ children }) {
  const isMobile = window.innerWidth <= 768;

  if (!isMobile) {
    return (
      <div className="desktop">
        <div className="desktop-box">
          <div className="desktop-image-slot">
            <img className="desktop-phone-image" src={phoneImage} alt="Phone" />
          </div>

          <h1>Mobile Only</h1>

          <p>
            This application is designed for mobile devices.
            Please open it on your smartphone to continue.
          </p>
        </div>
      </div>
    );
  }

  return children;
}

export default MobileOnly;