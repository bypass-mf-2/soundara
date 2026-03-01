import { Link } from "react-router-dom";
import logo from "../assets/soundara.jpg";

export default function Navbar() {
  return (
    <nav style={{ display: "flex", alignItems: "center", padding: "10px", borderBottom: "1px solid #ccc" }}>
      <img src={logo} alt="Soundara" style={{ height: "40px", marginRight: "20px" }} />
      <Link to="/" style={{ marginRight: "10px" }}>Home</Link>
      <Link to="/about" style={{ marginRight: "10px" }}>About</Link>
      <Link to="/contact">Contact</Link>
    </nav>
  );
}