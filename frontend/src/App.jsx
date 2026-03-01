import React, { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import About from "./pages/About.jsx";
import Contact from "./pages/Contact.jsx";
import Navbar from "./components/Navbar.jsx";

import { GoogleLogin, googleLogout } from "@react-oauth/google";
import * as jwt_decode from "jwt-decode"; // import as namespace

export default function App() {
  const [user, setUser] = useState(null);

  const handleLogout = () => {
    googleLogout();
    setUser(null);
  };

  return (
    <BrowserRouter>
      <Navbar user={user} onLogout={handleLogout} />

      {!user && (
        <div style={{ padding: "20px" }}>
          <GoogleLogin
            onSuccess={(credentialResponse) => {
              const profile = jwt_decode.default(credentialResponse.credential); // use .default
              setUser({
                name: profile.name,
                email: profile.email,
                picture: profile.picture,
              });
            }}
            onError={() => console.log("Login Failed")}
          />
        </div>
      )}

      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
    </BrowserRouter>
  );
}