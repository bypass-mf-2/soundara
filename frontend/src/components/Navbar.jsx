import { Link } from "react-router-dom";
import logo from "../assets/soundara.jpg";
import { trackEvent } from "../track_event.js";

export default function Navbar({ user, onLogout }) {
  const handleNavClick = (page) => {
    trackEvent({ type: "nav_click", page, user: user?.id });
  };

  return (
    <nav
      style={{
        display: "flex",
        top: 0,
        left: 0,
        right: 0,
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 10px",
        borderBottom: "1px solid #ccc",
      }}
    >
      {/* Left: Logo + Links */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <img src={logo} alt="Soundara" style={{ height: "60px", marginRight: "40px" }} />

        <Link to="/" onClick={() => handleNavClick("home")} style={{ marginRight: "5px" }}>
          Home
        </Link>
        <span style={{ borderRight: "1px solid #ccc", margin: "10px 10px", height: "30px" }}></span>
        <Link to="/library" onClick={() => handleNavClick("library")} style={{ marginRight: "0px", marginLeft: "0px"  }}>
          My Library
        </Link>
        <span style={{ borderRight: "1px solid #ccc", margin: "10px 10px", height: "30px" }}></span>
        <Link to="/pricing" onClick={() => handleNavClick("pricing")} style={{ marginRight: "0px", marginLeft: "0px"  }}>
          Pricing
        </Link>
        <span style={{ borderRight: "1px solid #ccc", margin: "10px 10px", height: "30px" }}></span>
        <Link to="/about" onClick={() => handleNavClick("about")} style={{ marginRight: "0px", marginLeft: "0px"  }}>
          About
        </Link>
        <span style={{ borderRight: "1px solid #ccc", margin: "10px 10px", height: "30px" }}></span>
        <Link to="/future" onClick={() => handleNavClick("future")} style={{ marginRight: "0px", marginLeft: "0px" }}>
          Future Projection
        </Link>
        <span style={{ borderRight: "1px solid #ccc", margin: "10px 10px", height: "30px" }}></span>
        <Link to="/contact" onClick={() => handleNavClick("contact")}>
          Contact
        </Link>
        
      </div>

      {/* Right: User info + Sign Out */}
      {user && (
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ marginRight: "15px" }}>Hi, {user.name}</span>
          <button
            onClick={onLogout}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #fff",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </nav>
  );
}